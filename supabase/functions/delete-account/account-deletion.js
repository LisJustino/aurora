export function deleteAccountPermanently(adminClient, userId) {
  return adminClient.auth.admin.deleteUser(userId, false);
}
