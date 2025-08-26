import { requireAuth, redirectIfAuthenticated } from './auth-guard'

const routes = [
  // Public routes with PublicLayout
  {
    path: '/public',
    component: () => import('layouts/PublicLayout.vue'),
    children: [
      {
        path: '/login',
        component: () => import('pages/LoginPage.vue'),
        beforeEnter: redirectIfAuthenticated,
      },
      {
        path: '/403',
        component: () => import('pages/Error403.vue'),
      },
      {
        path: '/visits/:patientId',
        component: () => import('pages/VisitsPage.vue'),
        beforeEnter: requireAuth,
      },
    ],
  },

  // Protected routes with MainLayout
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    beforeEnter: requireAuth,
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        component: () => import('pages/DashboardPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'patients',
        component: () => import('pages/PatientSearchPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'patient/:patientId',
        component: () => import('pages/PatientPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'visits',
        component: () => import('pages/VisitsPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'studies',
        component: () => import('pages/StudySearchPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'concepts',
        component: () => import('pages/ConceptsPage.vue'),
        meta: {
          requiresAuth: true,
          requiresRole: ['admin', 'physician'],
        },
      },
      {
        path: 'cql',
        component: () => import('pages/CqlPage.vue'),
        meta: {
          requiresAuth: true,
          requiresRole: ['admin', 'physician'],
        },
      },
      {
        path: 'settings',
        component: () => import('pages/SettingsPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'users',
        component: () => import('pages/UserManagementPage.vue'),
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'global-settings',
        component: () => import('pages/GlobalSettingsPage.vue'),
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'import',
        component: () => import('pages/ImportPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'export',
        component: () => import('pages/ExportPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'data-grid',
        component: () => import('pages/DataGridPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'data-grid/editor',
        component: () => import('pages/DataGridEditorPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'database-test',
        component: () => import('pages/DatabaseTest.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
