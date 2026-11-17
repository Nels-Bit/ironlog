import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('../src/services/exerciseService',()=>({exerciseService:{savePersonalSettings:vi.fn()}}));
import { ExerciseNotes } from '../src/components/ExerciseNotes';
const exercise={id:'mine',name:'Machine Press',category:'Machines',notes:'Seat 3\nElbows tucked.'};
it('starts collapsed with existing notes, automatic saving and the limit, without manual save/remove buttons',()=>{
  const html=renderToStaticMarkup(createElement(ExerciseNotes,{exercise}));
  expect(html).toContain('Seat 3\nElbows tucked.');expect(html).toContain('maxLength="500"');
  expect(html).toContain('<details');expect(html).toContain('<summary');expect(html).not.toContain(' open=');
  expect(html).not.toContain('Remove notes');expect(html).not.toContain('Save notes');expect(html).toContain('Private');
  expect(html).toContain('Saves automatically');expect(html).not.toContain('disabled=');
  expect(html).toContain('rows="1"');expect(html).toContain('resize-none');expect(html).not.toContain('resize-y');
});
it('renders notes as plain text instead of executable HTML',()=>{
  const html=renderToStaticMarkup(createElement(ExerciseNotes,{exercise:{...exercise,notes:'<script>alert(1)</script>'}}));
  expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');
});
it('does not offer a pretend save against a database without the migration',()=>{
  const html=renderToStaticMarkup(createElement(ExerciseNotes,{exercise:{...exercise,settingsAvailable:false}}));
  expect(html).toContain('need the database update');expect(html).not.toContain('<textarea');
});
