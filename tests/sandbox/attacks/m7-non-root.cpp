// M7: Verify non-root execution (geteuid() != 0) and inability to write to /root.
#include <fstream>
#include <iostream>
#include <unistd.h>

int main() {
  if (geteuid() == 0) {
    std::cout << "ROOT_ESCAPED:euid0\n";
    return 0;
  }
  std::ofstream out("/root/pwned.txt");
  if (out.is_open()) {
    out << "pwned\n";
    std::cout << "ROOT_ESCAPED:wrote_root\n";
    return 0;
  }
  std::cout << "NON_ROOT_OK:" << geteuid() << '\n';
  return 1;
}
