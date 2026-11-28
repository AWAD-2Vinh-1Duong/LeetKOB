// M1: Attempt to open a TCP socket and connect to an external host.
#include <arpa/inet.h>
#include <cstring>
#include <iostream>
#include <sys/socket.h>
#include <unistd.h>

int main() {
  int fd = socket(AF_INET, SOCK_STREAM, 0);
  if (fd < 0) {
    std::cout << "SOCKET_FAILED\n";
    return 1;
  }

  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(80);
  inet_pton(AF_INET, "1.1.1.1", &addr.sin_addr);

  int rc = connect(fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr));
  close(fd);
  if (rc == 0) {
    std::cout << "NETWORK_ESCAPED\n";
    return 0;
  }
  std::cout << "NETWORK_BLOCKED\n";
  return 1;
}
