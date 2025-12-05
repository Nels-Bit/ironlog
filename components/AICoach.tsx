
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, WorkoutSession, Exercise, ExerciseSet, User } from '../types';
import { createChatSession, sendMessageToChat, parseWorkoutFromAI } from '../services/geminiService';
import { getRecentWorkoutsContext, saveChatHistory, getChatHistory } from '../services/storageService';
import { Button } from './Button';
import { Send, Bot, User as UserIcon, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { Chat } from '@google/genai';
import { SYSTEM_INSTRUCTION_COACH } from '../constants';

interface AICoachProps {
    onImportWorkout: (template: Partial<WorkoutSession>) => void;
    user: User;
}

export const AICoach: React.FC<AICoachProps> = ({ onImportWorkout, user }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let instruction = SYSTEM_INSTRUCTION_COACH;
        
        if (user.allowAI) {
            instruction += `\n\nUSER PROFILE CONTEXT:\n`;
            instruction += `- Name: ${user.name}\n`;
            if (user.weight) instruction += `- Weight: ${user.weight} lbs\n`;
            if (user.heightFt) instruction += `- Height: ${user.heightFt}'${user.heightIn || 0}"\n`;
            if (user.sex) instruction += `- Sex: ${user.sex}\n`;
            if (user.frequency) instruction += `- Workout Frequency: ${user.frequency} times/week\n`;
            if (user.goal) instruction += `- Primary Goal: ${user.goal}\n`;

            const historyContext = getRecentWorkoutsContext(user.id);
            instruction += `\n${historyContext}\n`;
            instruction += `\nIMPORTANT: Use the user's history to apply progressive overload. Suggest weights based on their previous lifts.`;
        }

        const session = createChatSession(instruction);
        if (session) {
            setChatSession(session);
        } else {
            // Fallback error message if creation fails
            setMessages(prev => [...prev, {
                id: 'error',
                role: 'model',
                text: "I'm having trouble connecting to the AI service.",
                timestamp: Date.now()
            }]);
        }
    }, [user]);

    // Load persisted chat
    useEffect(() => {
        if (!user.id) return;
        const saved = getChatHistory(user.id);
        if (saved.length > 0) {
            setMessages(saved);
        } else {
             setMessages([{ 
                id: 'welcome', 
                role: 'model', 
                text: `Hi ${user.name}! I'm IronCoach. I've analyzed your stats${user.allowAI ? ' and recent workouts' : ''}. How can I help you train today?`, 
                timestamp: Date.now() 
            }]);
        }
    }, [user.id]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !chatSession) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: Date.now()
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        saveChatHistory(user.id, newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const responseText = await sendMessageToChat(chatSession, userMsg.text);
            
            const modelMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: responseText,
                timestamp: Date.now()
            };
            
            const finalMessages = [...newMessages, modelMsg];
            setMessages(finalMessages);
            saveChatHistory(user.id, finalMessages);

        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const checkAndImport = (text: string) => {
        const parsed = parseWorkoutFromAI(text);
        if (parsed && parsed.exercises) {
            const mappedExercises: Exercise[] = parsed.exercises.map((ex: any) => ({
                id: generateId(),
                name: ex.name,
                category: ex.category || 'Free Weight',
                isUnilateral: ex.isUnilateral || false,
                notes: ex.suggestedWeight ? `Suggestion: ${ex.suggestedWeight}` : undefined,
                sets: Array.from({ length: ex.sets || 3 }).map(() => ({
                    id: generateId(),
                    weight: 0,
                    reps: ex.reps || 10,
                    repsLeft: 0,
                    repsRight: 0,
                    distance: 0,
                    time: 0,
                    completed: false
                }))
            }));

            const template: Partial<WorkoutSession> = {
                name: parsed.workoutName || "AI Generated Workout",
                exercises: mappedExercises
            };

            onImportWorkout(template);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950">
            <header className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h1 className="font-bold text-white">IronCoach AI</h1>
                        <p className="text-xs text-slate-400">Powered by Gemini 2.5</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => {
                    const codeBlockRegex = /```(?:json)?\s*[\s\S]*?\s*```/;
                    const hasJSON = msg.role === 'model' && codeBlockRegex.test(msg.text);
                    
                    const displayText = msg.role === 'model' && hasJSON 
                        ? msg.text.replace(codeBlockRegex, '').trim() 
                        : msg.text;

                    return (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div 
                                className={`max-w-[85%] rounded-2xl p-4 ${
                                    msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                                }`}
                            >
                                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {displayText || (hasJSON ? "I've designed a workout plan for you:" : "")}
                                </div>

                                {hasJSON && (
                                    <div className="mt-3">
                                        <div className="bg-slate-950 rounded-lg p-3 border border-slate-700 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-indigo-400">
                                                <Sparkles size={16} />
                                                <span className="text-xs font-bold uppercase tracking-wide">Workout Plan Detected</span>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                onClick={() => checkAndImport(msg.text)}
                                                className="bg-indigo-500 hover:bg-indigo-400 text-white border-none text-xs"
                                            >
                                                Start This Workout <ArrowRight size={12} className="ml-1"/>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {isLoading && (
                     <div className="flex justify-start">
                        <div className="bg-slate-800 rounded-2xl rounded-tl-none p-4 flex items-center gap-2 border border-slate-700">
                            <Loader2 size={16} className="animate-spin text-indigo-400"/>
                            <span className="text-xs text-slate-400">Thinking...</span>
                        </div>
                     </div>
                )}
                <div ref={bottomRef} />
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800">
                <div className="relative flex items-center">
                    <input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Ask for a workout plan..."
                        disabled={isLoading}
                        className="w-full bg-slate-950 border border-slate-700 rounded-full pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 bg-indigo-600 rounded-full text-white disabled:bg-slate-700 disabled:text-slate-500 transition-colors hover:bg-indigo-500"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
