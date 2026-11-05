---
title: "Arena & Slab Memory Allocators in Systems Programming"
description: "Why lifetime-grouped arena allocators eliminate per-object free overhead and cache-line fragmentation in high-throughput services."
published: 2026-01-10
tags:
  - systems
  - memory
  - performance
---

# Arena & Slab Memory Allocators in Systems Programming

General-purpose heap allocators (`malloc` / `free`) must track arbitrary lifetimes for every individual allocation. When a request handler allocates thousands of small AST nodes or protocol buffers that all die together when the request completes, ==grouping allocations by lifetime into a linear arena== turns allocation into a single pointer bump and deallocation into an $O(1)$ reset.

> [!success]+ Foldable Callout: Zero Fragmentation with `Arena::reset()`
> Because an arena bumps a contiguous cursor forward, sibling nodes sit adjacent in L1/L2 cache lines instead of scattering across fragmented heap pages.

## Bump Allocator Implementation

```rust
pub struct Arena {
    buf: Vec<u8>,
    offset: usize,
}

impl Arena {
    pub fn with_capacity(cap: usize) -> Self {
        Self {
            buf: vec![0; cap],
            offset: 0,
        }
    }

    pub fn alloc(&mut self, size: usize, align: usize) -> Option<*mut u8> {
        let aligned = (self.offset + align - 1) & !(align - 1);
        let next = aligned.checked_add(size)?;
        if next > self.buf.len() {
            return None;
        }
        self.offset = next;
        Some(unsafe { self.buf.as_mut_ptr().add(aligned) })
    }

    pub fn reset(&mut self) {
        self.offset = 0;
    }
}
```

Next up in this category: [[consensus-raft-notes|Notes on Raft Consensus & Replicated State Machines]].
