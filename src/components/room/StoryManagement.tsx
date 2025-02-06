import { useState } from "react";
import type { Database } from "../../lib/database.types";
import toast from "react-hot-toast";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Story = Database["public"]["Tables"]["stories"]["Row"];

interface StoryManagementProps {
  room: Room;
  stories: Story[];
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSelectStory: (storyId: number) => void;
  onAddStory: (title: string, description: string) => void;
  onEditStory: (story: Story) => void;
  onAnonymizeStory: (storyId: number) => void;
  onAnonymizeAllStories: () => void;
}

export function StoryManagement({
  room,
  stories,
  isOpen,
  isLoading,
  onClose,
  onSelectStory,
  onAddStory,
  onEditStory,
  onAnonymizeStory,
  onAnonymizeAllStories,
}: StoryManagementProps) {
  const [isAddingStory, setIsAddingStory] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [newStoryDescription, setNewStoryDescription] = useState("");
  const [isAnonymizeModalOpen, setIsAnonymizeModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);

  const handleAddStory = () => {
    if (!newStoryTitle.trim()) {
      toast.error("Story title is required");
      return;
    }

    onAddStory(newStoryTitle.trim(), newStoryDescription.trim());
    setNewStoryTitle("");
    setNewStoryDescription("");
    setIsAddingStory(false);
  };

  const handleEditStory = () => {
    if (!editingStory) return;
    onEditStory(editingStory);
    setEditingStory(null);
  };

  return (
    <>
      <div
        className={`sidebar-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />
      <div className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-white">Stories</h2>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsAddingStory(true)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Add Story
              </button>
              <button
                onClick={() => setIsAnonymizeModalOpen(true)}
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-500 flex items-center gap-2"
                title="Anonymize all stories"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
                Anonymize All
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {stories.map((story) => (
              <div
                key={story.id}
                className={`story-card rounded-lg p-4 transition-colors
                  ${
                    story.id.toString() === room.current_story
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  }
                  ${isLoading ? "pointer-events-none opacity-50" : ""}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium">{story.title}</h5>
                    {story.description && (
                      <div className="text-gray-300 text-sm whitespace-pre-wrap">
                        {story.description}
                      </div>
                    )}
                    {story.final_estimate && (
                      <p className="mt-2 text-sm">
                        Final estimate:{" "}
                        <span className="font-bold">{story.final_estimate}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => onSelectStory(story.id)}
                      className={`rounded-md p-1 ${
                        story.id.toString() === room.current_story
                          ? "cursor-default"
                          : "hover:bg-gray-700"
                      }`}
                      disabled={story.id.toString() === room.current_story}
                      title={
                        story.id.toString() === room.current_story
                          ? "Current active story"
                          : "Set as active story"
                      }
                    >
                      <svg
                        className={`h-8 w-8 ${
                          story.id.toString() === room.current_story
                            ? "text-gray-400"
                            : "text-indigo-500 hover:text-indigo-400"
                        }`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM3.707 7.293a1 1 0 00-1.414-1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditingStory(story)}
                      className="rounded p-2 hover:bg-gray-700"
                      title="Edit story"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onAnonymizeStory(story.id)}
                      className="rounded p-2 hover:bg-gray-700"
                      title="Anonymize story"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Story Modal */}
      {isAddingStory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">Add New Story</h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-300"
                >
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={newStoryTitle}
                  onChange={(e) => setNewStoryTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-300"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={newStoryDescription}
                  onChange={(e) => setNewStoryDescription(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsAddingStory(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStory}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Add Story
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Story Modal */}
      {editingStory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">Edit Story</h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="edit-title"
                  className="block text-sm font-medium text-gray-300"
                >
                  Title
                </label>
                <input
                  type="text"
                  id="edit-title"
                  value={editingStory.title}
                  onChange={(e) =>
                    setEditingStory({ ...editingStory, title: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-description"
                  className="block text-sm font-medium text-gray-300"
                >
                  Description
                </label>
                <textarea
                  id="edit-description"
                  value={editingStory.description || ""}
                  onChange={(e) =>
                    setEditingStory({
                      ...editingStory,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEditingStory(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditStory}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anonymize All Modal */}
      {isAnonymizeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">
              Anonymize All Stories
            </h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to anonymize all stories? This will remove all
              votes and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsAnonymizeModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onAnonymizeAllStories();
                  setIsAnonymizeModalOpen(false);
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Anonymize All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
