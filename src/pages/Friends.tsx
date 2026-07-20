import { useEffect, useState } from 'react';
import { Loader2, Search, Users, UserPlus, Globe, Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { authService } from '../services/authService';
import { socialService } from '../services/socialService';
import type { FriendRequest, FriendSummary, FriendWithStats, UserProfile } from '../types';

export const Friends = () => {
  const [loading, setLoading] = useState(true);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [actingOnRequest, setActingOnRequest] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<FriendSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<FriendWithStats[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const results = await socialService.searchPublicUsers(query);
        if (!cancelled) {
          setSearchResults(results);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to search users.');
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [currentUser, friendsData, incoming, outgoing] = await Promise.all([
        authService.getUser(),
        socialService.getFriendsWithStats(),
        socialService.getIncomingFriendRequests(),
        socialService.getOutgoingFriendRequests()
      ]);
      setProfile(currentUser);
      setFriends(friendsData);
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load social data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    setSendingRequest(userId);
    setError(null);
    try {
      await socialService.sendFriendRequest(userId);
      setSearchTerm('');
      setSearchResults([]);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to send friend request.');
    } finally {
      setSendingRequest(null);
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    setActingOnRequest(requestId);
    setError(null);
    try {
      await socialService.respondToFriendRequest(requestId, accept);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to respond to friend request.');
    } finally {
      setActingOnRequest(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-500">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 p-6">
        <h1 className="text-2xl font-black italic text-white tracking-tighter">
          FRIEND<span className="text-brand-orange"> CENTER</span>
        </h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
        )}

        <div className="rounded-2xl border border-white/10 bg-iron-950 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Your User ID</p>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-300">
              {profile?.isPublic ? (
                <span className="inline-flex items-center gap-1"><Globe size={11} /> Public</span>
              ) : (
                <span className="inline-flex items-center gap-1"><Lock size={11} /> Private</span>
              )}
            </span>
          </div>
          <p className="text-xl font-black text-white">@{profile?.userId}</p>
          {!profile?.isPublic && (
            <p className="mt-2 text-xs text-zinc-400">
              Make your profile public in Profile settings to send and receive friend requests.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-iron-950 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search size={16} className="text-zinc-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-300">Find Friends</h2>
          </div>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by user-id or name"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-orange outline-none"
          />

          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map((result) => (
                <div key={result.authUserId} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                  <div>
                    <p className="font-bold text-white">{result.name}</p>
                    <p className="text-xs text-zinc-500">@{result.userId}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSendFriendRequest(result.userId)}
                    disabled={sendingRequest === result.userId || !profile?.isPublic}
                  >
                    {sendingRequest === result.userId ? <Loader2 size={14} className="animate-spin" /> : <><UserPlus size={14} className="mr-1" /> Add</>}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-iron-950 p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-300 mb-3">Incoming Requests</h2>
          {incomingRequests.length === 0 ? (
            <p className="text-sm text-zinc-500">No incoming requests.</p>
          ) : (
            <div className="space-y-2">
              {incomingRequests.map((request) => (
                <div key={request.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="font-bold text-white">{request.requester.name}</p>
                  <p className="text-xs text-zinc-500 mb-3">@{request.requester.userId}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRespond(request.id, true)}
                      disabled={actingOnRequest === request.id}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRespond(request.id, false)}
                      disabled={actingOnRequest === request.id}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-iron-950 p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-300 mb-3">Outgoing Requests</h2>
          {outgoingRequests.length === 0 ? (
            <p className="text-sm text-zinc-500">No pending outgoing requests.</p>
          ) : (
            <div className="space-y-2">
              {outgoingRequests.map((request) => (
                <div key={request.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="font-bold text-white">{request.addressee.name}</p>
                  <p className="text-xs text-zinc-500">@{request.addressee.userId}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-iron-950 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-zinc-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-300">Friends</h2>
          </div>
          {friends.length === 0 ? (
            <p className="text-sm text-zinc-500">No friends yet.</p>
          ) : (
            <div className="space-y-2">
              {friends.map((friend) => (
                <div key={friend.authUserId} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{friend.name}</p>
                      <p className="text-xs text-zinc-500">@{friend.userId}</p>
                    </div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                      Friends since {new Date(friend.friendsSince).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Workouts</p>
                      <p className="text-lg font-black text-white">{friend.totalWorkouts}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Total Volume</p>
                      <p className="text-lg font-black text-white">{friend.totalVolume.toLocaleString()} lbs</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
