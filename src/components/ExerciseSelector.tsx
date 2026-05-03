import { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2, ChevronLeft, Loader2, Dumbbell, Check } from 'lucide-react';
import { exerciseService } from '../services/exerciseService';
import type { Exercise } from '../types';
import { cn } from '../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ex: Exercise) => void;
}

export const ExerciseSelector = ({ isOpen, onClose, onSelect }: Props) => {
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [search, setSearch] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  // New Exercise Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Free Weights');
  const [newTarget, setNewTarget] = useState('Chest');
  const [isUnilateral, setIsUnilateral] = useState(false);

  // Load exercises when modal opens
  useEffect(() => {
    if (isOpen) {
      loadExercises();
      // Lock body scroll
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const loadExercises = async () => {
    setLoading(true);
    const data = await exerciseService.getAllExercises();
    setExercises(data);
    setLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (confirm(`Delete custom exercise "${name}"?`)) {
      await exerciseService.deleteCustomExercise(id);
      loadExercises();
    }
  };

  const handleCreate = async () => {
    if (!newName) return;
    setLoading(true);
    const created = await exerciseService.createExercise({
      name: newName,
      category: newCategory,
      target: newTarget,
      isUnilateral
    });
    
    if (created) {
      onSelect(created);
      onClose();
      resetForm();
    }
    setLoading(false);
  };

  const resetForm = () => {
    setNewName('');
    setMode('search');
    setSearch('');
  };

  const switchToCreate = () => {
    setNewName(search);
    setMode('create');
  };

  const filtered = exercises.filter(ex => 
    ex.name.toLowerCase().includes(search.toLowerCase())
  );

  const hasNoResults = search.trim() !== '' && filtered.length === 0;

  if (!isOpen) return null;

  return (
    // FULL SCREEN CONTAINER
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in slide-in-from-bottom duration-300">
      
      {/* --- HEADER (Fixed Top) --- */}
      <header className="shrink-0 h-16 flex items-center justify-between px-4 border-b border-white/5 bg-iron-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {mode === 'create' && (
            <button 
              onClick={() => setMode('search')}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white transition-colors active:scale-95"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <h2 className="text-xl font-bold text-white tracking-tight">
            {mode === 'search' ? 'Select Exercise' : 'New Exercise'}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {mode === 'search' && (
            <button
              onClick={switchToCreate}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-orange text-white shadow-lg shadow-brand-orange/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={22} />
            </button>
          )}
          
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-red-500 transition-colors active:scale-95"
          >
            <X size={22} />
          </button>
        </div>
      </header>

      {/* --- SEARCH MODE --- */}
      {mode === 'search' && (
        <>
          {/* Sticky Search Bar */}
          <div className="shrink-0 px-4 py-3 bg-black/80 backdrop-blur-sm sticky top-16 z-40">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input 
                autoFocus
                type="text" 
                placeholder="Find movement..."
                className="w-full bg-iron-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-lg text-white placeholder:text-zinc-600 focus:border-brand-orange outline-none transition-all shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto px-4 pb-safe space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-sm">Loading Library...</p>
              </div>
            ) : (
              <>
                {/* Exercise Cards */}
                {filtered.map(ex => (
                  <div
                    key={ex.id}
                    onClick={() => onSelect(ex)}
                    className="group relative bg-iron-950 border border-white/5 rounded-2xl p-5 active:scale-[0.98] transition-transform duration-150 cursor-pointer overflow-hidden"
                  >
                    {/* Active Gradient Border Effect (Subtle) */}
                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-white/5 rounded-2xl pointer-events-none transition-colors" />

                    <div className="relative flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-bold text-white text-lg mb-1.5 truncate">
                          {ex.name}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 bg-white/5 px-2 py-1 rounded">
                            {ex.target}
                          </span>
                          <span className="text-xs text-zinc-600">•</span>
                          <span className="text-xs text-zinc-500 font-medium">{ex.category}</span>
                          {ex.isUnilateral && (
                            <span className="text-[10px] font-bold bg-brand-orange/20 text-brand-orange px-2 py-0.5 rounded uppercase tracking-wide ml-1">
                              Uni
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        {ex.isCustom && (
                          <button 
                            onClick={(e) => handleDelete(e, ex.id, ex.name)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-600 hover:bg-red-500/10 hover:text-red-500 transition-colors z-10"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-brand-orange group-hover:text-white transition-colors">
                          <Plus size={20} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Empty State */}
                {filtered.length === 0 && !loading && (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-iron-950 border border-white/5 flex items-center justify-center">
                      <Dumbbell className="text-zinc-700" size={32} />
                    </div>
                    <p className="text-zinc-500 font-medium">No exercises found.</p>
                    {search && (
                      <button 
                        onClick={switchToCreate}
                        className="mt-4 text-brand-orange font-bold hover:underline"
                      >
                        Create "{search}"?
                      </button>
                    )}
                  </div>
                )}

                {/* Create Button (When no results) */}
                {hasNoResults && (
                  <button
                    onClick={switchToCreate}
                    className="w-full bg-brand-orange/10 border border-brand-orange/30 rounded-2xl p-6 mt-4 flex items-center justify-center gap-3 hover:bg-brand-orange/20 transition-all active:scale-[0.98]"
                  >
                    <Plus size={20} className="text-brand-orange" />
                    <span className="text-white font-bold">Create "{search}"</span>
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* --- CREATE MODE --- */}
      {mode === 'create' && (
        <div className="flex-1 overflow-y-auto px-4 pb-safe bg-black">
          <div className="py-6 space-y-8">
            
            {/* Name Input */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase text-zinc-500 tracking-widest pl-1">Name</label>
              <input 
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Bulgarian Split Squat"
                className="w-full bg-iron-950 border border-white/10 rounded-2xl p-5 text-white text-xl font-bold placeholder:text-zinc-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all"
              />
            </div>

            {/* Selectors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase text-zinc-500 tracking-widest pl-1">Category</label>
                <div className="relative">
                  <select 
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-iron-950 border border-white/10 rounded-2xl p-4 pr-10 text-white font-medium appearance-none focus:border-brand-orange outline-none"
                  >
                    {['Free Weights', 'Machines', 'Cables', 'Cardio', 'Bodyweight', 'Other'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronLeft className="absolute right-4 top-1/2 -translate-y-1/2 rotate-[-90deg] text-zinc-600 pointer-events-none" size={16} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase text-zinc-500 tracking-widest pl-1">Target Muscle</label>
                <div className="relative">
                  <select 
                    value={newTarget}
                    onChange={e => setNewTarget(e.target.value)}
                    className="w-full bg-iron-950 border border-white/10 rounded-2xl p-4 pr-10 text-white font-medium appearance-none focus:border-brand-orange outline-none"
                  >
                    <option value="Chest">Chest</option>
                    <option value="Back">Back</option>
                    <option value="Shoulders">Shoulders</option>
                    <option value="Biceps">Biceps</option>
                    <option value="Triceps">Triceps</option>
                    <option value="Forearms">Forearms</option>
                    <option value="Quads">Quads</option>
                    <option value="Hamstrings">Hamstrings</option>
                    <option value="Glutes">Glutes</option>
                    <option value="Calves">Calves</option>
                    <option value="Core">Core</option>
                    <option value="Full Body">Full Body</option>
                    <option value="Other">Other</option>
                  </select>
                  <ChevronLeft className="absolute right-4 top-1/2 -translate-y-1/2 rotate-[-90deg] text-zinc-600 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            {/* Unilateral Toggle */}
            <div 
              className={cn(
                "flex items-center gap-5 p-5 rounded-2xl border-2 transition-all cursor-pointer select-none active:scale-[0.99]",
                isUnilateral 
                  ? "bg-brand-orange/10 border-brand-orange shadow-lg shadow-brand-orange/10" 
                  : "bg-iron-950 border-white/10 hover:bg-white/5"
              )}
              onClick={() => setIsUnilateral(!isUnilateral)}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all shrink-0",
                isUnilateral 
                  ? "bg-brand-orange border-brand-orange text-white" 
                  : "border-zinc-700 bg-black/40"
              )}>
                {isUnilateral && <Check size={20} strokeWidth={3} />}
              </div>
              <div className="flex-1">
                <p className={cn(
                  "text-lg font-bold transition-colors", 
                  isUnilateral ? "text-brand-orange" : "text-white"
                )}>
                  Unilateral Exercise
                </p>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">Logs weight for Left & Right separately</p>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleCreate}
              disabled={loading || !newName}
              className={cn(
                "w-full py-5 rounded-2xl font-black text-lg uppercase tracking-wide transition-all shadow-xl mt-8",
                !newName || loading
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-brand-orange text-white hover:bg-orange-500 active:scale-[0.98] shadow-brand-orange/20"
              )}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={24} /> 
                  <span>Saving...</span>
                </div>
              ) : (
                'Save Exercise'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};