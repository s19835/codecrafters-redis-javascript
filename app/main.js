import net from "net";

// Object for stroing key value pair for GET, SET
const store = {};

// Get the specified port from input
const args = process.argv;
let port;
if (args.includes('--port')) { 
    port = parseInt(args[args.indexOf('--port') + 1]); 
} else {
    port = 6379;
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
                
                if (args.includes('--replicaof')) {
                    const replica = args[args.indexOf('--replicaof') + 1].split(' ');
                    const replicaof = parseInt(replica[1]);
                    
                    if (replicaof === port) {
                        throw new Error('Setting the replicaof to the current instance is not allowed.');
                    } else {
                        role = redisProtocolParser('role:slave');
                    }

                } else {
                    role = redisProtocolParser('role:master');
                }

                const infoReplication = redisProtocolParser(header+role);
                connection.write(infoReplication);
            }
            break;
        
        default:
            break;
    }
  })
});

server.listen(port, "127.0.0.1");
