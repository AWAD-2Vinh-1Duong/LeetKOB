# PA2 Submission

- Public Repository link: https://github.com/AWAD-2Vinh-1Duong/LeetKOB
- Branch protection: ![branch-protection](docs/tasks/proof-report/assets/branch-protection.png)
- Link Pull request được quyền merged/đã merged (bao gồm commit bị từ chối, commit chỉnh sửa - màu xanh): https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/6
- CI run failed: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/41222159341
- CI run successed: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/41223080718
- Deliberate contract break (PR): https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/8
  - Commit vi phạm contract (bỏ idempotency lookup): https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/8/commits/fb6e601019dee79c7a768e11c19a6fb030114ba6
  - CI run đỏ (3 test idempotency fail): https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/41383050327
  - Commit sửa lại cho đúng contract (không sửa test): https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/8/commits/d7d4c9211c4e34fa82f98f56db49aa58c70833fd
  - CI run xanh trở lại: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/41383117774
