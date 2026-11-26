// M5: Spawn processes repeatedly until hitting --pids-limit.
#include <iostream>
#include <sys/wait.h>
#include <unistd.h>

int main() {
  int spawned = 0;
  for (int i = 0; i < 200; ++i) {
    pid_t pid = fork();
    if (pid == 0) {
      sleep(2);
      _exit(0);
    }
    if (pid < 0) {
      std::cout << "PIDS_LIMITED:" << spawned << '\n';
      return 1;
    }
    ++spawned;
  }
  while (wait(nullptr) > 0) {
  }
  std::cout << "PIDS_ESCAPED:" << spawned << '\n';
  return 0;
}
