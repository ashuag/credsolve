type UserLike = {
  id: bigint;
  fullName: string;
  email: string;
  roleId: number;
  userRole?: {
    name: string;
  } | null;
};

export function serializeLosUser(user: UserLike) {
  const roleName = user.userRole?.name ?? null;

  return {
    id: user.id.toString(),
    fullName: user.fullName,
    email: user.email,
    roleId: user.roleId,
    role: roleName,
    roleName,
  };
}
