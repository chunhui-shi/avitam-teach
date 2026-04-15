'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Option {
  id: number;
  text: string;
  is_correct: boolean;
  order_index: number;
}

interface Block {
  id: number;
  block_type: string;
  content: string;
  order_index: number;
  options?: Option[];
}

export default function LessonPage() {
  const params = useParams();
  const lessonId = params.id as string;
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [askingAssistant, setAskingAssistant] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    fetch(`/api/lessons/${lessonId}/blocks`)
      .then((res) => res.json())
      .then((data) => {
        setBlocks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load blocks:', err);
        setLoading(false);
      });
  }, [lessonId]);

  const handleAskAssistant = async () => {
    if (!question.trim()) return;

    setAskingAssistant(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAssistantAnswer(data.answer || data.error || 'No response');
    } catch (err) {
      setAssistantAnswer('Error contacting assistant');
    } finally {
      setAskingAssistant(false);
    }
  };

  const handleAnswerQuiz = async (blockId: number, optionId: number) => {
    setSelectedAnswers({ ...selectedAnswers, [blockId]: optionId });
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1, // In real app, get from auth
          blockId,
          selectedOptionId: optionId,
        }),
      });
      const data = await res.json();
      console.log('Quiz answer submitted:', data);
    } catch (err) {
      console.error('Failed to submit quiz answer:', err);
    }
  };

  if (loading) return <div className="text-center py-8">Loading lesson...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="space-y-8">
        {blocks.map((block) => (
          <div key={block.id} className="bg-white p-6 rounded-lg shadow-md">
            {block.block_type === 'text' && (
              <div className="prose prose-sm max-w-none">{block.content}</div>
            )}

            {block.block_type === 'quiz' && (
              <div>
                <h3 className="text-lg font-bold mb-4">{block.content}</h3>
                <div className="space-y-3">
                  {block.options?.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleAnswerQuiz(block.id, option.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition ${
                        selectedAnswers[block.id] === option.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {option.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {block.block_type === 'code' && (
              <div>
                <h3 className="text-lg font-bold mb-4">Code Exercise</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code>{block.content}</code>
                </pre>
                <button className="mt-4 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                  Run Code
                </button>
              </div>
            )}
          </div>
        ))}

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-bold mb-4">Ask the Teaching Assistant</h3>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about this lesson..."
            className="w-full p-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
          <button
            onClick={handleAskAssistant}
            disabled={askingAssistant}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {askingAssistant ? 'Thinking...' : 'Ask Assistant'}
          </button>

          {assistantAnswer && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-bold mb-2">Assistant Response:</h4>
              <p className="text-gray-800 whitespace-pre-wrap">{assistantAnswer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
