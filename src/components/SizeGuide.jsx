import { Ruler } from 'lucide-react'
import { SIZE_GUIDE } from '../data/sizeGuide'

export default function SizeGuide({ highlight }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-sand-dark sm:p-5">
      <div className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-sage-dark" />
        <h4 className="text-sm font-semibold">Size Guide</h4>
        <span className="ml-auto text-xs text-ink-soft">inches unless noted</span>
      </div>

      <div className="no-scrollbar -mx-4 mt-3 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        <table className="w-full min-w-[420px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-soft">
              <th scope="col" className="py-2 pr-3 font-medium">Size</th>
              <th scope="col" className="py-2 pr-3 font-medium">Height (cm)</th>
              <th scope="col" className="py-2 pr-3 font-medium">Chest</th>
              <th scope="col" className="py-2 pr-3 font-medium">Waist</th>
              <th scope="col" className="py-2 pr-3 font-medium">Tee length</th>
              <th scope="col" className="py-2 font-medium">Shorts length</th>
            </tr>
          </thead>
          <tbody>
            {SIZE_GUIDE.map((r) => {
              const on = r.size === highlight
              const cell = `py-2.5 pr-3 border-t border-sand ${on ? 'bg-sage-light/60 font-semibold' : ''}`
              return (
                <tr key={r.size}>
                  <th scope="row" className={`${cell} rounded-l-lg pl-2 font-semibold`}>{r.size}</th>
                  <td className={cell}>{r.heightCm}</td>
                  <td className={cell}>{r.chest}″</td>
                  <td className={cell}>{r.waist}″</td>
                  <td className={cell}>{r.tee}″</td>
                  <td className={`${cell} rounded-r-lg`}>{r.shorts}″</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 space-y-1 text-xs leading-relaxed text-ink-soft">
        <li>• <strong className="font-semibold text-ink">Go by height first</strong> — it’s the most reliable guide.</li>
        <li>• Chest, waist &amp; height are your child’s body. Lengths are measured on the garment.</li>
        <li>• Between sizes? Size up — cotton relaxes, kids grow fast.</li>
      </ul>
    </div>
  )
}
