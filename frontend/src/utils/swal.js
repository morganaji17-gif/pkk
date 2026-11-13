import Swal from 'sweetalert2'

const swal = Swal.mixin({
  confirmButtonColor: '#C75B39',
  cancelButtonColor: '#64748b',
  reverseButtons: true,
  customClass: {
    popup: 'swal-popup',
  },
})

export async function confirmDelete({ title, text }) {
  const result = await swal.fire({
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: 'Hapus',
    cancelButtonText: 'Batal',
  })

  return result.isConfirmed
}

/**
 * Konfirmasi umum (bukan hapus). Tombol konfirmasi bisa dikustom.
 */
export async function confirmAction({
  title,
  text,
  confirmButtonText = 'Lanjutkan',
  cancelButtonText = 'Batal',
  icon = 'warning',
}) {
  const result = await swal.fire({
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
  })

  return result.isConfirmed
}

export function toastSuccess(title) {
  swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  })
}

export function toastError(title) {
  swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'error',
    title,
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
  })
}

export default swal