"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeLosUser = serializeLosUser;
exports.serializeLosUsers = serializeLosUsers;
function serializeLosUser(user) {
    const serializedUser = {
        ...user,
        id: user.id.toString(),
    };
    if ('managerId' in user) {
        serializedUser.managerId = user.managerId ? user.managerId.toString() : null;
    }
    if ('manager' in user) {
        serializedUser.manager = user.manager
            ? {
                ...user.manager,
                id: user.manager.id.toString(),
            }
            : null;
    }
    return serializedUser;
}
function serializeLosUsers(users) {
    return users.map(serializeLosUser);
}
