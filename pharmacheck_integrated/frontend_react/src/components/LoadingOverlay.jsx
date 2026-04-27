import { motion } from 'framer-motion'

const STEPS = [
  { label: 'Parsing report text',       delay: 0    },
  { label: 'Running rule engine',        delay: 0.6  },
  { label: 'Querying vector index',      delay: 1.2  },
  { label: 'Retrieving regulations',     delay: 1.8  },
  { label: 'Generating explanations',    delay: 2.4  },
  { label: 'Computing compliance score', delay: 3.0  },
]

export default function LoadingOverlay() {
  return (
    <div className="glass-card rounded-xl p-8 text-center space-y-6">
      {/* Spinner */}
      <div className="flex justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 rounded-full border-2 border-t-accent-lime animate-spin" />
          <div className="absolute inset-2 rounded-full border border-accent-cyan/30 animate-spin-slow" />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-text-primary">Checking compliance…</p>
        <p className="text-xs text-text-muted mt-1">RAG pipeline running across 649 regulatory chunks</p>
      </div>

      {/* Step indicators */}
      <div className="space-y-2 max-w-xs mx-auto text-left">
        {STEPS.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: step.delay, duration: 0.3 }}
            className="flex items-center gap-2 text-xs text-text-muted"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: step.delay + 0.1 }}
              className="w-1.5 h-1.5 rounded-full bg-accent-lime shrink-0"
            />
            {step.label}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
