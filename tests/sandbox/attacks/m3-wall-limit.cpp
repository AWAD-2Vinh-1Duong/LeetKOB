// M3: Sleep longer than the wall-clock limit while using zero CPU.
// Requires the runner to kill the container itself, not only a child process.
#include <iostream>
#include <unistd.h>

int main() {
  sleep(30);
  std::cout << "WALL_ESCAPED\n";
  return 0;
}
