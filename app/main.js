import net from "net";

// Object for stroing key value pair for GET, SET
const store = {};

// Get the specified port from input
const args = process.argv;
let port, replicaof, master, replicaPort;
let replId = '8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb';
let replOffset = 0;

if (args.includes('--port')) { 
    port = parseInt(args[args.indexOf('--port') + 1]);

    if (args.includes('--replicaof')) {
        const replicas = args[args.indexOf('--replicaof') + 1].split(' ');
        replicaof = parseInt(replicas[1]);

        // Create connection to the master port from slave
        master = net.createConnection({
            host: replicas[0],
            port: replicaof
        }, () => {
            master.write(`*1\r\n${redisProtocolParser('PING')}`);
        });
    }
} else {
    port = 6379;
}

if (master) {
    master.on("data", (data) => {
        if (data.includes('PONG')) {
            master.write(`*3\r\n${redisProtocolParser('REPLCONF')}${redisProtocolParser('listening-port')}${redisProtocolParser(port.toString())}`);
        }
    
        if (data.includes('OK')) {
            master.write(`*3\r\n${redisProtocolParser('REPLCONF')}${redisProtocolParser('capa')}${redisProtocolParser('psync2')}`);
            master.write(`*3\r\n${redisProtocolParser('PSYNC')}${redisProtocolParser('?')}${redisProtocolParser('-1')}`);
        }

        if (data.includes('+FULLRESYNC')) {
            const dataSet = data.toString().split(' ');
            const replId = dataSet[dataSet.indexOf('+FULLRESYNC') + 1];
        }
    });

    master.on("close", () => {
        console.log('connection closed');
    });

    master.on("error", (err) => {
        console.error('Error: ', err.message);
    })
}

// Implement a Redis protocol parser
function redisProtocolParser(data) {
    return `$${data.length}\r\n${data}\r\n`;
}

const server = net.createServer((connection) => {
  // Handle connection
  connection.on("data", (data) => {
    const recived = data.toString().split('\r\n');
    
    if (!recived) {
        throw new Error("Invalid input");
    }

    const command = recived[2].toUpperCase();

    switch (command) {
        case 'PING':
            connection.write('+PONG\r\n'); // Simple String response
            break;
        
        case 'ECHO':
            connection.write(redisProtocolParser(recived[4])); // Bulk String response
            break;

        case 'SET':
            store[recived[4]] = recived[6];
            connection.write('+OK\r\n');

            if (recived[8]) {
                const waitTime = parseInt(recived[10]);
                setTimeout(() => {
                    delete store[recived[4]];
                }, waitTime);
            }
            break;

        case 'GET':
            if (recived[4] in store) { 
                const value = store[recived[4]];
                connection.write(redisProtocolParser(value));
            } else {
                connection.write('$-1\r\n');
            }
            break;

        case 'INFO':
            if (recived[4].toLowerCase() === 'replication') {
                const header = redisProtocolParser('# Replication');
                let role;
                
                if (replicaof) {
                    if (replicaof === port) {
                        throw new Error('Setting the replicaof to the current instance is not allowed.');
                    } else {
                        role = redisProtocolParser('role:slave');
                    }

                } else {
                    role = redisProtocolParser('role:master');
                }

                const replIdStr = redisProtocolParser(`master_replid:${replId}`);
                const replOffsetStr = redisProtocolParser(`master_repl_offset:${replOffset}`);

                const infoReplication = redisProtocolParser(header+role+replIdStr+replOffsetStr);
                connection.write(infoReplication);
            }
            break;

        case 'REPLCONF':
            // replica is available on listening port for any potential reverse communication.
            const replconf = data.toString().split('\r\n');
            if (replconf.includes('listening-port')) {
                replicaPort = replconf[replconf.indexOf('listening-port') + 2];
            }

            connection.write('+OK\r\n');
            break;

        case 'PSYNC':
            connection.write(`+FULLRESYNC ${replId} ${replOffset}\r\n`);

            // After sending the FULLRESYNC replica expecting an rdb file of current state in master
            const rdbFileBase64 = "UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog==";

            const decodedBinaryData = Buffer.from(rdbFileBase64, 'base64');
            const fileLength = Buffer.from(`$${decodedBinaryData.length}\r\n`);
            // $<length_of_file>\r\n<contents_of_file>
            const formatedRdb = Buffer.concat([fileLength, decodedBinaryData]);
            
            connection.write(formatedRdb);
            break;
        
        default:
            break;
    }
  });
});

server.listen(port, "127.0.0.1");
