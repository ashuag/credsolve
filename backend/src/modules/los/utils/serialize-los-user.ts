type LosUserWithBigIntId = {
  id: bigint;
  managerId?: bigint | null;
  manager?: ({ id: bigint } & Record<string, unknown>) | null;
};

export function serializeLosUser<T extends LosUserWithBigIntId>(
  user: T,
): Omit<T, 'id' | 'managerId' | 'manager'> & {
  id: string;
  managerId?: string | null;
  manager?: (Omit<NonNullable<T['manager']>, 'id'> & { id: string }) | null;
} {
  const serializedUser = {
    ...user,
    id: user.id.toString(),
  } as Omit<T, 'id' | 'managerId' | 'manager'> & {
    id: string;
    managerId?: string | null;
    manager?: (Omit<NonNullable<T['manager']>, 'id'> & { id: string }) | null;
  };

  if ('managerId' in user) {
    serializedUser.managerId = user.managerId ? user.managerId.toString() : null;
  }

  if ('manager' in user) {
    serializedUser.manager = user.manager
      ? {
          ...user.manager,
          id: user.manager.id.toString(),
        } as Omit<NonNullable<T['manager']>, 'id'> & { id: string }
      : null;
  }

  return serializedUser;
}

export function serializeLosUsers<T extends LosUserWithBigIntId>(
  users: T[],
){
  return users.map(serializeLosUser);
}
