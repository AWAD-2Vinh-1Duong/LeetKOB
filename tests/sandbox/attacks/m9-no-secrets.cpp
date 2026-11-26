// M9: Attempt to read secrets from environment variables or files.
#include <cstdlib>
#include <fstream>
#include <iostream>

int main() {
  const char* keys[] = {"LLM_API_KEY", "DATABASE_URL", "JWT_SECRET"};
  for (const char* k : keys) {
    const char* val = std::getenv(k);
    if (val && val[0] != '\0') {
      std::cout << "SECRET_ENV_ESCAPED:" << k << '\n';
      return 0;
    }
  }
  const char* paths[] = {"/.env", "/app/.env"};
  for (const char* p : paths) {
    std::ifstream f(p);
    if (f.is_open()) {
      std::cout << "SECRET_FILE_ESCAPED:" << p << '\n';
      return 0;
    }
  }
  std::cout << "NO_SECRETS_OK\n";
  return 1;
}
