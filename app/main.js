import net from "net";


const server = net.createServer((connection) => {
  // Handle connection
  connection.write('+PONG\r\n');
});

server.listen(6379, "127.0.0.1");
