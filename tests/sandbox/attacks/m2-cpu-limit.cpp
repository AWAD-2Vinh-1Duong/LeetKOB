// M2: Infinite CPU-bound loop to trigger the CPU time limit.
#include <iostream>

int main() {
  volatile unsigned long long acc = 0;
  while (true) {
    acc = acc + 1;
  }
  std::cout << acc << '\n';
  return 0;
}
