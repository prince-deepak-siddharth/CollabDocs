'use client';

import { ActiveUser } from '@/lib/types';

interface Props {
    users: ActiveUser[];
}

export default function ActiveUsers({ users }: Props) {
    if (users.length === 0) return null;

    return (
        <div className="active-users">
            {users.map((user, i) => (
                <div
                    key={`${user.user_name}-${i}`}
                    className="active-user"
                    style={{
                        background: user.color,
                        zIndex: users.length - i,
                    }}
                >
                    {user.user_name.charAt(0)}
                    <span className="user-tooltip">{user.user_name}</span>
                </div>
            ))}
        </div>
    );
}
