/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';

export const defaultNavigation: FuseNavigationItem[] = [
    {
        id   : 'create.event',
        title: 'Créer un evenement',
        type : 'basic',
        icon : 'heroicons_outline:plus',
        link : '/events/create-event'
    },
    {
        id   : 'list.event',
        title: 'Liste des évènements',
        type : 'basic',
        icon : 'heroicons_outline:list-bullet',
        link : '/events/event-list'
    },
    {
        id   : 'user.create',
        title: 'Créer un utilisateur',
        type : 'basic',
        icon : 'heroicons_outline:user-plus',
        link : '/user-management/create-user'
    },
    {
        id   : 'user.list',
        title: 'Liste des utilisateurs',
        type : 'basic',
        icon : 'heroicons_outline:users',
        link : '/user-management/list-user'
    },
    {
        id   : 'list.event',
        title: 'Deconnexion',
        type : 'basic',
        icon : 'logout',
        link : '/sign-out'
    }
];
export const compactNavigation: FuseNavigationItem[] = [
    {
        id   : 'example',
        title: 'Example',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/example'
    }
];
export const futuristicNavigation: FuseNavigationItem[] = [
    {
        id   : 'example',
        title: 'Example',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/example'
    }
];
export const horizontalNavigation: FuseNavigationItem[] = [
    {
        id   : 'example',
        title: 'Example',
        type : 'basic',
        icon : 'heroicons_outline:chart-pie',
        link : '/example'
    }
];
