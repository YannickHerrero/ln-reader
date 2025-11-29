type DeinflectionRule = {
  from: string
  to: string[]
}

const verbRules: DeinflectionRule[] = [
  // Te-form and continuous
  { from: 'ている', to: ['る'] },
  { from: 'てる', to: ['る'] },
  { from: 'ていた', to: ['る'] },
  { from: 'てた', to: ['る'] },
  { from: 'ておく', to: ['る'] },
  { from: 'とく', to: ['る'] },

  // Polite forms
  { from: 'ます', to: ['る', 'う', 'く', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'ぐ'] },
  { from: 'ました', to: ['る', 'う', 'く', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'ぐ'] },
  { from: 'ません', to: ['る', 'う', 'く', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'ぐ'] },
  { from: 'ましょう', to: ['る', 'う', 'く', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'ぐ'] },

  // Negative forms
  { from: 'ない', to: ['る', 'う', 'く', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'ぐ'] },
  { from: 'なかった', to: ['る', 'う', 'く', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'ぐ'] },
  { from: 'ず', to: ['る', 'う', 'く', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'ぐ'] },

  // Past tense (ta-form)
  { from: 'った', to: ['う', 'つ', 'る'] },
  { from: 'んだ', to: ['ぬ', 'ぶ', 'む'] },
  { from: 'いた', to: ['く'] },
  { from: 'いだ', to: ['ぐ'] },
  { from: 'した', to: ['す'] },
  { from: 'た', to: ['る'] },

  // Te-form
  { from: 'って', to: ['う', 'つ', 'る'] },
  { from: 'んで', to: ['ぬ', 'ぶ', 'む'] },
  { from: 'いて', to: ['く'] },
  { from: 'いで', to: ['ぐ'] },
  { from: 'して', to: ['す'] },
  { from: 'て', to: ['る'] },

  // Potential forms
  { from: 'られる', to: ['る'] },
  { from: 'れる', to: ['る'] },
  { from: 'える', to: ['う'] },
  { from: 'ける', to: ['く'] },
  { from: 'せる', to: ['す'] },
  { from: 'てる', to: ['つ'] },
  { from: 'ねる', to: ['ぬ'] },
  { from: 'べる', to: ['ぶ'] },
  { from: 'める', to: ['む'] },
  { from: 'げる', to: ['ぐ'] },

  // Passive/Causative
  { from: 'られる', to: ['る'] },
  { from: 'させる', to: ['る', 'す'] },
  { from: 'される', to: ['す'] },
  { from: 'われる', to: ['う'] },
  { from: 'かれる', to: ['く'] },
  { from: 'たれる', to: ['つ'] },
  { from: 'なれる', to: ['ぬ'] },
  { from: 'ばれる', to: ['ぶ'] },
  { from: 'まれる', to: ['む'] },
  { from: 'がれる', to: ['ぐ'] },

  // Volitional
  { from: 'よう', to: ['る'] },
  { from: 'おう', to: ['う'] },
  { from: 'こう', to: ['く'] },
  { from: 'そう', to: ['す'] },
  { from: 'とう', to: ['つ'] },
  { from: 'のう', to: ['ぬ'] },
  { from: 'ぼう', to: ['ぶ'] },
  { from: 'もう', to: ['む'] },
  { from: 'ごう', to: ['ぐ'] },

  // Imperative
  { from: 'ろ', to: ['る'] },
  { from: 'れ', to: ['る'] },
  { from: 'え', to: ['う'] },
  { from: 'け', to: ['く'] },
  { from: 'せ', to: ['す'] },
  { from: 'て', to: ['つ'] },
  { from: 'ね', to: ['ぬ'] },
  { from: 'べ', to: ['ぶ'] },
  { from: 'め', to: ['む'] },
  { from: 'げ', to: ['ぐ'] },

  // Conditional
  { from: 'れば', to: ['る'] },
  { from: 'えば', to: ['う'] },
  { from: 'けば', to: ['く'] },
  { from: 'せば', to: ['す'] },
  { from: 'てば', to: ['つ'] },
  { from: 'ねば', to: ['ぬ'] },
  { from: 'べば', to: ['ぶ'] },
  { from: 'めば', to: ['む'] },
  { from: 'げば', to: ['ぐ'] },
  { from: 'たら', to: ['る', 'う', 'く', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'ぐ'] },
]

const ichidanRules: DeinflectionRule[] = [
  // Ichidan verb special handling (drop る for stem)
  { from: 'て', to: ['る'] },
  { from: 'た', to: ['る'] },
  { from: 'ない', to: ['る'] },
  { from: 'なかった', to: ['る'] },
  { from: 'ます', to: ['る'] },
  { from: 'ました', to: ['る'] },
  { from: 'ません', to: ['る'] },
  { from: 'られる', to: ['る'] },
  { from: 'させる', to: ['る'] },
  { from: 'よう', to: ['る'] },
  { from: 'ろ', to: ['る'] },
  { from: 'れば', to: ['る'] },
]

const adjectiveRules: DeinflectionRule[] = [
  // I-adjective conjugations
  { from: 'かった', to: ['い'] },
  { from: 'くない', to: ['い'] },
  { from: 'くなかった', to: ['い'] },
  { from: 'くて', to: ['い'] },
  { from: 'く', to: ['い'] },
  { from: 'ければ', to: ['い'] },
  { from: 'さ', to: ['い'] },
]

const specialCases: Record<string, string[]> = {
  // Irregular verbs
  'した': ['する'],
  'して': ['する'],
  'しない': ['する'],
  'しなかった': ['する'],
  'します': ['する'],
  'しました': ['する'],
  'しません': ['する'],
  'しよう': ['する'],
  'しろ': ['する'],
  'せよ': ['する'],
  'すれば': ['する'],
  'される': ['する'],
  'させる': ['する'],
  'できる': ['する'],

  'きた': ['くる', '来る'],
  'きて': ['くる', '来る'],
  'こない': ['くる', '来る'],
  'こなかった': ['くる', '来る'],
  'きます': ['くる', '来る'],
  'きました': ['くる', '来る'],
  'きません': ['くる', '来る'],
  'こよう': ['くる', '来る'],
  'こい': ['くる', '来る'],
  'くれば': ['くる', '来る'],
  'こられる': ['くる', '来る'],
  'こさせる': ['くる', '来る'],

  'いった': ['いく', '行く'],
  'いって': ['いく', '行く'],

  'ある': ['ある'],
  'あった': ['ある'],
  'あって': ['ある'],
  'ない': ['ない', 'ある'],
  'なかった': ['ない', 'ある'],

  // Common contracted forms
  'ちゃう': ['てしまう'],
  'じゃう': ['でしまう'],
  'ちゃった': ['てしまった'],
  'じゃった': ['でしまった'],
}

export function deinflect(word: string): string[] {
  const results = new Set<string>([word])

  // Check special cases first
  if (specialCases[word]) {
    specialCases[word].forEach(form => results.add(form))
  }

  // Try all rule sets
  const allRules = [...verbRules, ...ichidanRules, ...adjectiveRules]

  for (const rule of allRules) {
    if (word.endsWith(rule.from)) {
      const stem = word.slice(0, -rule.from.length)
      if (stem.length > 0) {
        for (const ending of rule.to) {
          results.add(stem + ending)
        }
      }
    }
  }

  // For very short words, be conservative
  if (word.length <= 2) {
    return [word]
  }

  return Array.from(results)
}
