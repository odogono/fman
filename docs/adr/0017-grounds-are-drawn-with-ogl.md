---
status: accepted
---

# Grounds are drawn in 3D with OGL

The clips' grounds (the pitch, stands, boards and goals) are drawn in 3D with WebGL, through the OGL library. The players, the ball and the fans stay as today's 2D sprites, standing in the 3D scene. Whether this painter replaces the 2D one or sits beside it as a fallback is decided separately. A 3D ground lets the camera tilt and zoom smoothly, lets the stands and goals cast real shadows, and opens the way to a different ground for each club. The prototype for #263 showed that the 3D ground keeps the pixel-art look and holds 60 fps on a mid-range phone.

OGL was chosen because the scene needs so little: a ground plane, a few merged meshes, one sun casting shadows, a camera, and the sprite shader, which we write ourselves anyway. OGL adds about 15 KB gzipped, where three.js added about 119 KB, roughly doubling the app's download. In exchange we write the sun's shadow pass ourselves, about 100 lines.

## Considered Options

- **three.js.** The prototype was built with it first. It worked with no extra code, but it costs about eight times as much to download, and nearly all of it went unused.
- **regl or twgl.js.** About 40 KB and 23 KB gzipped. Both are thinner wrappers around WebGL than OGL, so they leave more for us to write and save no more size.
- **Plain WebGL2.** A few KB, but about 500 lines of our own code to keep up, for about 10 KB less than OGL.
- **Canvas 2D, without WebGL.** Possible, because heights are drawn straight up the screen, so a flat camera maps every surface to the screen with a simple transform. It adds nothing to the download, but it is the most code to write and the least likely to hold 60 fps on a phone.

## Consequences

The ground's pieces are built as plain triangles with no library in them (`web/src/view/ground/solid.ts`). Only the painter touches OGL, so moving to another renderer would mean rewriting the painter alone.

Heights in the 3D ground are leaned up the screen, as the sprites draw them: one metre of height rises one metre up the screen at any tilt. Without this, the goals and stands look squat beside the sprites.
