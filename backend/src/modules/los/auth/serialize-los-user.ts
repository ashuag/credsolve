type UserLike = {
  id: bigint;
  fullName: string;
  email: string;
  roleId: number;
  userRole?: {
    name: string;
    hierarchyLevel?: number;
  } | null;
};

export function serializeLosUser(user: UserLike) {
  const roleName = user.userRole?.name ?? null;
  const hierarchyLevel = user.userRole?.hierarchyLevel ?? null;

  return {
    id: user.id.toString(),
    fullName: user.fullName,
    email: user.email,
    roleId: user.roleId,
    role: roleName,
    roleName,
    hierarchyLevel,
  };
}
