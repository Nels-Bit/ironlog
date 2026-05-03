import { Trophy } from 'lucide-react';

interface Props {
  exerciseName: string;
  weight: number;
  date: number;
}

export const PRCard = ({ exerciseName, weight, date }: Props) => {
  return (
    <div className="bg-iron-950 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-brand-orange/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange">
          <Trophy size={18} />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">{exerciseName}</h3>
          <p className="text-xs text-zinc-500">{new Date(date).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="text-right">
        <span className="text-xl font-black text-white italic">{weight}</span>
        <span className="text-xs text-zinc-500 font-bold ml-1">KG</span>
      </div>
    </div>
  );
};