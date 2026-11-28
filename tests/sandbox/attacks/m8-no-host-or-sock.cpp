// M8: Attempt to access Docker socket or host mount paths.
#include <fstream>
#include <iostream>
#include <sys/stat.h>

int main() {
  struct stat st {};
  if (stat("/var/run/docker.sock", &st) == 0) {
    std::cout << "DOCKER_SOCK_ESCAPED\n";
    return 0;
  }
  std::ifstream hostEnv("/etc/shadow");
  if (hostEnv.is_open()) {
    std::cout << "HOST_SHADOW_ESCAPED\n";
    return 0;
  }
  std::cout << "HOST_AND_SOCK_BLOCKED\n";
  return 1;
}
