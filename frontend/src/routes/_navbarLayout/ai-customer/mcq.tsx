import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/_navbarLayout/ai-customer/mcq')({
  component: RouteComponent,
})

const options = [
  {
    id: 'A',
    text: 'Ask customer what they are looking for, put down your cell phone and punch in their sale.',
    feedback: "Just a reminder: Being on your cell phone while on the floor is against Gen 7 policies and procedures. Keeping your focus entirely on the customers helps us provide that top-tier service!",
  },
  {
    id: 'B',
    text: 'Say Hello to customer. Ask them what they want. If they are buying fuel ask them what pump they are at. Confirm the sale. Tap the Gen 7 cash card and method of payment.',
    feedback: "You're getting there! In this scenario, we missed asking for the Status Card and the Gen 7 Cash Card. Also, don't forget to thank the customer—it's the Gen 7 way!",
  },
  {
    id: 'C',
    text: 'Say Hi and smile at the customer. Confirm pump number, $sale, and fuel grade. Ask customer if they have a status card. Ask customer for Gen 7 cash card, if customer does not have a card, tap and give them one. Thank the customer and process the sale.',
    feedback: "Spot on! You're a Gen 7 Rockstar. 🌟 You covered all the bases from the smile to the rewards. Keep that gold standard going!",
  },
  {
    id: 'D',
    text: 'Say Hi and smile at the customer. Confirm pump number, $sale, and fuel grade. Ask customer for Gen 7 cash card, if customer does not have a card, tap and give them one. Thank the customer and process the sale.',
    feedback: "So close! You missed asking for the Status Card. Remember: once a transaction is finished, it cannot be undone if the status card isn't attached. We want to make sure our customers get their benefits every time!",
  },
]

function RouteComponent() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Helper to determine color theme based on the selection
  const getThemeColor = (id: string | null) => {
    if (id === 'C') return 'green'
    if (id === 'A') return 'red'
    return 'orange'
  }

  const theme = getThemeColor(selectedOption)

  const handleSelect = (id: string) => {
    setSelectedOption(id)
    setIsDialogOpen(true)
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-slate-100 p-6 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-orange-600 p-10 text-white text-center">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">Gen 7 Academy</h1>
          <p className="mt-1 opacity-80 text-sm font-bold">CUSTOMER SERVICE MODULE</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-8 leading-tight">
            What are the Gen 7 Customer Engagement Standards?
          </h2>

          <div className="space-y-3">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 flex gap-4 items-center group ${selectedOption === option.id
                    ? option.id === 'C' ? 'border-green-500 bg-green-50' : option.id === 'A' ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50'
                    : 'border-gray-100 hover:border-orange-200 hover:bg-orange-50/30'
                  }`}
              >
                <span className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold transition-colors ${selectedOption === option.id
                    ? (option.id === 'C' ? 'bg-green-500 text-white' : option.id === 'A' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white')
                    : 'bg-gray-100 text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-600'
                  }`}>
                  {option.id}
                </span>
                <span className="text-gray-700 font-semibold">{option.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dialog Overlay */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">

            {/* Dynamic color bar based on your request */}
            <div className={`h-3 w-full ${theme === 'green' ? 'bg-green-500' : theme === 'red' ? 'bg-red-500' : 'bg-orange-500'
              }`} />

            <div className="p-10 text-center">
              <div className="text-6xl mb-6">
                {theme === 'green' ? '✅' : theme === 'red' ? '🚫' : '📝'}
              </div>

              <h3 className={`text-3xl font-black mb-4 uppercase tracking-tighter ${theme === 'green' ? 'text-green-600' : theme === 'red' ? 'text-red-600' : 'text-orange-600'
                }`}>
                {theme === 'green' ? 'Awesome!' : theme === 'red' ? 'Quick Warning' : 'Nice Try!'}
              </h3>

              <p className="text-gray-600 font-medium leading-relaxed">
                {options.find(o => o.id === selectedOption)?.feedback}
              </p>

              <button
                onClick={() => { setIsDialogOpen(false); if (selectedOption !== 'C') setSelectedOption(null); }}
                className={`mt-8 w-full py-4 rounded-2xl font-black text-white shadow-lg transition-transform active:scale-95 uppercase tracking-widest ${theme === 'green' ? 'bg-green-500 shadow-green-200' : theme === 'red' ? 'bg-red-500 shadow-red-200' : 'bg-orange-500 shadow-orange-200'
                  }`}
              >
                {theme === 'green' ? 'Next Session' : 'Try Again'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}