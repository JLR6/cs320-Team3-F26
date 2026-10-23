// needed for useState; various functions and/or components use this to render client-side instead of server-side
// this is because some things need that functionality since there is dynamic client-side content with them - server-side can't account for that
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Home() {
  const [name, setName] = useState('');

  return (
    // center the items
    <div className="flex min-h-screen items-center justify-center p-6">
      {/* a card with label and input components from shadcn */}
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 pt-6">
          <h1 className="text-xl font-bold">Component Test</h1>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={() => alert(`Hello, ${name}!`)}>
            Submit
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
