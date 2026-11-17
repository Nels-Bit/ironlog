import { expect, it, vi } from 'vitest';
import { createDemoProvider } from '../src/lib/demo-transport';
import { createIronLogSeed } from '../src/lib/demo-seed';
import { createNotesAutosave } from '../src/utils/notesAutosave';
it('creates, reloads and edits an owned exercise without losing history or personal notes',async()=>{
  const provider=createDemoProvider(createIronLogSeed());
  vi.doMock('../src/lib/supabase',()=>({supabase:provider.client}));
  const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Live request forbidden'));
  try {
    const {exerciseService}=await import('../src/services/exerciseService');
    const created=await exerciseService.createExercise({name:'Plate-loaded Press',category:'Machines',target:'Chest',startingResistance:20.5,notes:'Seat 3\nKeep shoulders down.'});
    expect(created).toMatchObject({isCustom:true,startingResistance:20.5,notes:'Seat 3\nKeep shoulders down.'});
    const reloaded=(await exerciseService.getAllExercises()).find(ex=>ex.id===created.id)!;
    expect(reloaded.startingResistance).toBe(20.5);
    const changed=await exerciseService.updateExercise(created.id,{name:'My Chest Press',startingResistance:30});
    expect(changed.id).toBe(created.id); expect(changed.notes).toBe(created.notes);
    // The definition editor has no notes field: do not overwrite a concurrent autosave.
    const rpc=vi.spyOn(provider.client,'rpc');
    await exerciseService.updateExercise(created.id,{name:'My Chest Press'});
    expect(rpc).toHaveBeenCalledWith('save_custom_exercise',expect.objectContaining({p_notes:null}));
    rpc.mockRestore();
    expect(provider.snapshot().tables.exercises.filter(ex=>ex.id===created.id)).toHaveLength(1);
    const autosave=createNotesAutosave({saved:changed.notes ?? '',draft:null,
      save:notes=>exerciseService.savePersonalSettings(changed,{notes},provider.snapshot().user.id),
      storeDraft:()=>{},clearDraft:()=>{},
    });
    autosave.update('Seat 4. Updated while logging.');await autosave.flush();
    expect((await exerciseService.getAllExercises()).find(ex=>ex.id===created.id)).toMatchObject({notes:'Seat 4. Updated while logging.',startingResistance:30});
    autosave.update('');await autosave.flush();
    expect((await exerciseService.getAllExercises()).find(ex=>ex.id===created.id)?.notes).toBe('');
    await exerciseService.savePersonalSettings(changed,{notes:''});
    expect((await exerciseService.getAllExercises()).find(ex=>ex.id===created.id)).toMatchObject({notes:'',startingResistance:30});
    await expect(exerciseService.savePersonalSettings(changed,{notes:'x'.repeat(501)})).rejects.toThrow('500');
    await expect(exerciseService.updateExercise('demo-bench',{name:'Not mine'})).rejects.toThrow('Only exercises');
    await expect(exerciseService.updateExercise(created.id,{startingResistance:-1})).rejects.toThrow('Starting resistance');
    // Built-in exercise notes are private preferences, not mutations of the shared definition.
    const builtin=(await exerciseService.getAllExercises()).find(ex=>ex.id==='demo-bench')!;
    await exerciseService.savePersonalSettings(builtin,{notes:'My bench setup'});
    await expect(exerciseService.savePersonalSettings(builtin,{notes:'Wrong account'},'someone-else')).rejects.toThrow('Sign in to your account');
    await exerciseService.savePersonalSettings(builtin,{notes:'My bench setup'},provider.snapshot().user.id);
    expect((await exerciseService.getAllExercises()).find(ex=>ex.id===builtin.id)?.notes).toBe('My bench setup');
    expect(provider.snapshot().tables.exercises.find(ex=>ex.id==='demo-bench')).not.toHaveProperty('notes');
    const secondSeed={...provider.snapshot(),user:{...provider.snapshot().user,id:'demo-jordan'}};
    const second=createDemoProvider(secondSeed);
    expect((await second.client.from('exercise_settings').select('*').eq('user_id','demo-jordan')).data).toEqual([]);
    expect(network).not.toHaveBeenCalled();
  } finally {network.mockRestore();vi.doUnmock('../src/lib/supabase');}
});
