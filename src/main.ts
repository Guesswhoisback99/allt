import '@fontsource/dm-sans/300.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './styles.css';

import dataset from 'virtual:dataset';
import { initTabs } from './views/tabs';
import { initChart } from './views/chart';
import { initTable } from './views/table';

initTabs();
initChart(dataset);
initTable(dataset);
