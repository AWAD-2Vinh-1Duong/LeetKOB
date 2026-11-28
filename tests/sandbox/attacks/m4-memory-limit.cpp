// M4: Allocate memory exceeding RAM+swap limit and touch every page
// so the compiler (-O2) cannot optimize away the allocation.
#include <cstdint>
#include <iostream>
#include <vector>

int main() {
  constexpr size_t totalBytes = 256ULL * 1024ULL * 1024ULL;
  std::vector<uint8_t> buf(totalBytes, 1);
  for (size_t i = 0; i < totalBytes; i += 4096) {
    buf[i] = static_cast<uint8_t>((i >> 12) & 0xff);
  }
  volatile uint64_t checksum = 0;
  for (size_t i = 0; i < totalBytes; i += 4096) {
    checksum += buf[i];
  }
  std::cout << "MEMORY_ESCAPED:" << checksum << '\n';
  return 0;
}
