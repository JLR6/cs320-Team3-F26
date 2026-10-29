'use client';

import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostList } from './posts/PostList';
import type { FeedType } from '@/types/feed';

interface FeedProps {
  currentUserId?: string; // undefined = logged out
}

// The center column of the main page: feed tabs, refresh + "New post" buttons, and the posts.
// The left sidebar and right tags bank belong to the page layout, not to this component.
export function Feed({ currentUserId }: FeedProps) {
  const [feed, setFeed] = useState<FeedType>('main');
  const [createOpen, setCreateOpen] = useState(false); // is the "new post" dialog open?
  const [refreshKey, setRefreshKey] = useState(0); // +1 makes PostList reload
  const isLoggedIn = !!currentUserId;

  return (
    <section className="space-y-4">
      {/* TOOLBAR: feed tabs on the left, buttons on the right */}
      <div className="flex items-center justify-between gap-2">
        <Tabs
          value={feed}
          onValueChange={(value) => setFeed(value as FeedType)}
        >
          <TabsList>
            <TabsTrigger value="main">Main</TabsTrigger>
            {/* Logged-out users can only see the main feed */}
            <TabsTrigger value="following" disabled={!isLoggedIn}>
              Following
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setRefreshKey((k) => k + 1)}
            aria-label="Refresh feed"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {/* Clicking this opens the create form */}
          <Button onClick={() => setCreateOpen(true)} disabled={!isLoggedIn}>
            <Plus className="mr-1 h-4 w-4" /> New post
          </Button>
        </div>
      </div>

      {/* POSTS */}
      <PostList
        feed={feed}
        refreshKey={refreshKey}
        currentUserId={currentUserId}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
      />
    </section>
  );
}
