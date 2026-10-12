export default function CategoryFilter({ categories, selected, onSelect }) {
  return (
    <nav className="category-filter" aria-label="Filter kategori menu">
      <button
        type="button"
        className={`chip ${selected === null ? 'chip--active' : ''}`}
        onClick={() => onSelect(null)}
      >
        Semua
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={`chip ${selected === category.id ? 'chip--active' : ''}`}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </button>
      ))}
    </nav>
  )
}
