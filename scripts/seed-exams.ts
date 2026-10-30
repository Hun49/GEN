// Load environment variables FIRST before importing db!
import 'dotenv/config'
import { db } from '../src/db/index.ts'
import { exams, questions } from '../src/db/schema.ts'

const SAMPLE_EXAMS = [
  {
    title: 'Computer Science: Algorithms & Data Structures',
    subject: 'Computer Science',
    description: 'Fundamental algorithmic analysis, sorting complexities, binary heaps, and graph traversals.',
    difficulty: 'medium' as const,
    authorDisplayName: 'CodeMaster #482a',
    tags: ['Algorithms', 'DataStructures', 'BigO'],
    questions: [
      {
        order: 1,
        type: 'multiple-choice' as const,
        question: 'What is the worst-case time complexity of QuickSort when using a naive pivot selection on an already sorted array?',
        options: ['O(n log n)', 'O(n)', 'O(n²)', 'O(log n)'],
        correctAnswer: 'O(n²)',
        explanation: 'When a naive pivot is selected on already sorted data, partitioning results in subproblems of sizes 0 and n-1, leading to quadratic O(n²) comparisons.',
      },
      {
        order: 2,
        type: 'multiple-choice' as const,
        question: 'Which data structure is fundamentally utilized to implement Breadth-First Search (BFS) in a graph?',
        options: ['Stack', 'Queue', 'Min-Heap', 'Disjoint Set'],
        correctAnswer: 'Queue',
        explanation: 'BFS explores neighbors level-by-level using a FIFO (First-In, First-Out) Queue to order vertices by distance from the source.',
      },
      {
        order: 3,
        type: 'true-false' as const,
        question: 'An AVL tree guarantees that the height difference between left and right subtrees for any node never exceeds 1.',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'The AVL balancing criterion strictly enforces that the balance factor (height(left) - height(right)) for every node is in {-1, 0, 1}.',
      },
      {
        order: 4,
        type: 'multiple-choice' as const,
        question: 'What is the space complexity of Depth-First Search (DFS) on a balanced binary tree with N nodes?',
        options: ['O(N)', 'O(log N)', 'O(1)', 'O(N²)'],
        correctAnswer: 'O(log N)',
        explanation: 'For a balanced binary tree, the maximum call stack depth corresponds to the tree height h = O(log N).',
      },
      {
        order: 5,
        type: 'short-answer' as const,
        question: 'Name the algorithmic paradigm used by Dijkstra algorithm to find the shortest path in a weighted graph with non-negative edges.',
        options: null,
        correctAnswer: 'Greedy',
        explanation: 'Dijkstra algorithm is a greedy algorithm that repeatedly selects the vertex with the minimal tentative distance from the unvisited set.',
      },
    ],
  },
  {
    title: 'Mathematics: Differential Calculus & Limits',
    subject: 'Mathematics',
    description: 'Derivative rules, L Hôpital limit evaluations, continuity, and critical value optimization.',
    difficulty: 'hard' as const,
    authorDisplayName: 'MathWhiz #9c1f',
    tags: ['Calculus', 'Limits', 'Derivatives'],
    questions: [
      {
        order: 1,
        type: 'multiple-choice' as const,
        question: 'What is the derivative of f(x) = ln(3x² + 1) with respect to x?',
        options: ['6x / (3x² + 1)', '1 / (3x² + 1)', '6x ln(3x² + 1)', '3x / (3x² + 1)'],
        correctAnswer: '6x / (3x² + 1)',
        explanation: 'By the chain rule, d/dx[ln(u)] = (1/u) * u\'. Here u = 3x² + 1 and u\' = 6x, so the derivative is 6x / (3x² + 1).',
      },
      {
        order: 2,
        type: 'multiple-choice' as const,
        question: 'Evaluate the limit: lim (x -> 0) [sin(5x) / x].',
        options: ['0', '1', '5', 'Does not exist'],
        correctAnswer: '5',
        explanation: 'Using the fundamental trigonometric limit lim (u -> 0) [sin(u)/u] = 1, rewrite as 5 * lim (x -> 0) [sin(5x) / (5x)] = 5 * 1 = 5.',
      },
      {
        order: 3,
        type: 'true-false' as const,
        question: 'If a function f(x) is continuous at x = c, then f(x) is guaranteed to be differentiable at x = c.',
        options: ['True', 'False'],
        correctAnswer: 'False',
        explanation: 'Continuity does not imply differentiability. The classic counterexample is f(x) = |x| at x = 0, which is continuous but has a sharp corner (no unique tangent line).',
      },
    ],
  },
  {
    title: 'Biology: Cellular Respiration & ATP Synthesis',
    subject: 'Biology',
    description: 'Glycolysis, the Krebs cycle, oxidative phosphorylation, and mitochondrial ATP synthase.',
    difficulty: 'easy' as const,
    authorDisplayName: 'BioPro #3d88',
    tags: ['CellBiology', 'Respiration', 'Mitochondria'],
    questions: [
      {
        order: 1,
        type: 'multiple-choice' as const,
        question: 'In eukaryotic cells, where does glycolysis take place?',
        options: ['Mitochondrial matrix', 'Cytoplasm', 'Inner mitochondrial membrane', 'Nucleus'],
        correctAnswer: 'Cytoplasm',
        explanation: 'Glycolysis is the universal initial pathway of glucose breakdown and takes place entirely in the cytosol / cytoplasm.',
      },
      {
        order: 2,
        type: 'multiple-choice' as const,
        question: 'Which organelle is widely referred to as the powerhouse of the cell due to producing the majority of cellular ATP?',
        options: ['Endoplasmic Reticulum', 'Golgi Apparatus', 'Mitochondria', 'Lysosome'],
        correctAnswer: 'Mitochondria',
        explanation: 'Mitochondria perform the citric acid cycle and oxidative phosphorylation, generating the bulk of the cell ATP.',
      },
      {
        order: 3,
        type: 'true-false' as const,
        question: 'Anaerobic fermentation yields significantly more ATP molecules per glucose molecule than aerobic cellular respiration.',
        options: ['True', 'False'],
        correctAnswer: 'False',
        explanation: 'Fermentation produces only 2 net ATP per glucose (from glycolysis), whereas aerobic cellular respiration produces approximately 30-32 ATP.',
      },
    ],
  },
]

async function seed() {
  console.log('Seeding demo public exams...')

  for (const sample of SAMPLE_EXAMS) {
    const examId = `seed_${crypto.randomUUID().slice(0, 8)}`
    await db.insert(exams).values({
      id: examId,
      userId: 'seed_author',
      authorDisplayName: sample.authorDisplayName,
      title: sample.title,
      subject: sample.subject,
      description: sample.description,
      difficulty: sample.difficulty,
      questionCount: sample.questions.length,
      isPublic: true,
      tags: JSON.stringify(sample.tags),
    })

    for (const q of sample.questions) {
      await db.insert(questions).values({
        id: `seed_q_${crypto.randomUUID().slice(0, 8)}`,
        examId,
        order: q.order,
        type: q.type,
        question: q.question,
        options: q.options ? JSON.stringify(q.options) : null,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })
    }
  }

  console.log('✓ Seeding complete! Added 3 high-quality community exams.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seeding error:', err)
  process.exit(1)
})
