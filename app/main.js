import net from "net";

const store = {} // Object for stroing key value pair for GET, SET

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
        
        default:
            break;
    }
  })
});

server.listen(6379, "127.0.0.1");
