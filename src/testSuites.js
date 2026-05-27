import classDiagramTests from '../tests.json'
import sequenceDiagramTests from '../uml_sequence_diagram_tests.json'
import reliabilityModelsTests from '../reliability_models_10_exam_style.json'
import module2GroupATests from '../module2_group_a_tests_v2_checked.json'
import module2GroupCTests from '../module2_group_c_tests.json'
import module2GroupDTests from '../module2_group_d_questions_5_30.json'

export const testSuites = [
  {
    id: 'class-diagrams',
    title: 'UML: діаграма класів',
    questions: classDiagramTests,
  },
  {
    id: 'sequence-diagrams',
    title: 'UML: діаграма послідовності',
    questions: sequenceDiagramTests,
  },
  {
    id: 'reliability-models',
    title: 'Моделі надійності ПЗ',
    questions: reliabilityModelsTests,
  },
  {
    id: 'module-2-group-a',
    title: 'Модуль 2: група A',
    questions: module2GroupATests,
  },
  {
    id: 'module-2-group-c',
    title: 'Модуль 2: група C',
    questions: module2GroupCTests,
  },
  {
    id: 'module-2-group-d',
    title: 'Модуль 2: група D, питання 5-30',
    questions: module2GroupDTests,
  },
]
