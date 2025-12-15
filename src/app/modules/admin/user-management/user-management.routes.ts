import { UserManagementComponent } from './user-management.component';
import { CreateUserComponent } from './create-user/create-user.component';
import { ListUserComponent } from './list-user/list-user.component';

export default [
    {
        path: '',
        component: UserManagementComponent,
        children: [
            {
                component: ListUserComponent,
                path: 'list-user',
            },
            {
                component: CreateUserComponent,
                path: 'create-user',
            }
        ]
    }
];
