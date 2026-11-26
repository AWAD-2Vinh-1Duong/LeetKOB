// M6: Flood stdout/stderr infinitely to trigger the output size cap.
#include <cstring>
#include <unistd.h>

int main() {
  char chunk[4096];
  std::memset(chunk, 'A', sizeof(chunk));
  while (true) {
    ssize_t n = write(STDOUT_FILENO, chunk, sizeof(chunk));
    if (n <= 0) break;
  }
  return 0;
}
