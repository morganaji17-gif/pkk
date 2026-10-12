const TABLE_STATUS = {
  available: { label: 'Tersedia' },
  occupied: { label: 'Terisi' },
  maintenance: { label: 'Tidak Tersedia' },
}

export function tableStatusInfo(status) {
  return TABLE_STATUS[status] || { label: status }
}