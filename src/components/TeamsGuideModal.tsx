import React from 'react';
import { HelpCircle, Monitor, Mic, Volume2, Keyboard, ShieldAlert } from 'lucide-react';

interface TeamsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamsGuideModal: React.FC<TeamsGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Online Competition & Audio Proctoring Guide
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          
          {/* Step 1 */}
          <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-1.5">
            <div className="font-bold text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>1. Sharing Audio with Students (Word Pronunciation)</span>
            </div>
            <p>
              When sharing your screen during online competition, make sure to enable{' '}
              <strong className="text-slate-900 dark:text-white">&quot;Include computer sound&quot;</strong> or{' '}
              <strong className="text-slate-900 dark:text-white">&quot;Share audio&quot;</strong>. This allows remote students to clearly hear the computer reading the spelling word, definitions, and sentences in high fidelity.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Mic className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>2. Capturing the Student&apos;s Voice</span>
            </div>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>
                <strong>Speakers & Room Mic (Simplest):</strong> Turn up your computer speakers and enable the app microphone. When the student speaks through your computer speakers, the app hears and transcribes the letters.
              </li>
              <li>
                <strong>Virtual Audio Cable (Best for Headsets):</strong> If wearing headphones, install a free audio loopback tool like <em>VB-CABLE</em> (Windows) or <em>BlackHole</em> (Mac). Route audio output to the cable and select it in Chrome.
              </li>
            </ul>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>3. Crucial Student Instructions</span>
            </div>
            <p>Before beginning their turn, instruct the student to:</p>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              <li>Set mic Noise Suppression to <strong>&quot;Low&quot;</strong> (high noise suppression can cut off sharp consonant letters like &apos;T&apos;, &apos;K&apos;, or &apos;P&apos;).</li>
              <li>Keep their face centered inside the green guide lines on camera.</li>
              <li>Say each letter with a steady, distinct pause: e.g. <em>&quot;A ... P ... P ... L ... E&quot;</em>.</li>
              <li>For duplicate letters, they can say <em>&quot;double L&quot;</em> or <em>&quot;L ... L&quot;</em> — both are recognized!</li>
            </ol>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-purple-600 shrink-0" />
              <span>4. Keyboard Backup & Adjudication Override</span>
            </div>
            <p>
              If a student has microphone latency or internet instability:
            </p>
            <p>
              The judge can type directly on their physical keyboard while the timer is running. Letters appear instantly as tiles. You can also press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono">1</kbd> for Correct or <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono">2</kbd> for Miss during adjudication.
            </p>
          </div>

        </div>

        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold rounded-xl text-xs transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
