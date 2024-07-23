import net from "net";

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
            connection.write('+PONG\r\n');
            break;
        
        case 'ECHO':
            connection.write(redisProtocolParser(recived[4]));
            break;

        default:
            break;
    }
  })
});

server.listen(6379, "127.0.0.1");
