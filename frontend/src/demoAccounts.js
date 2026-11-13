/**
 * Akun demo publik Pesanin.
 *
 * Hanya tiga akun seeder di bawah ini yang boleh dipakai untuk akses demo.
 * Jangan menambahkan akun lain, dan jangan memakai kredensial staf asli.
 * Samakan nilainya dengan backend/database/seeders/UserSeeder.php.
 */
export const DEMO_ACCOUNTS = {
  admin: {
    email: 'admin@example.com',
    password: 'Admin123!',
    label: 'Admin',
    destination: '/admin',
  },
  cashier: {
    email: 'cashier@example.com',
    password: 'Cashier123!',
    label: 'Cashier',
    destination: '/cashier',
  },
  kitchen: {
    email: 'kitchen@example.com',
    password: 'Kitchen123!',
    label: 'Kitchen',
    destination: '/kitchen',
  },
}

export const ROLE_LABELS = {
  admin: 'Admin',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
}

export function roleDestination(role) {
  return DEMO_ACCOUNTS[role]?.destination || '/cashier'
}
