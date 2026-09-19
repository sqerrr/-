import { Simulation } from '../core/simulation.js';
function assert(ok, message) {
    if (!ok)
        throw new Error('squad-regression: ' + message);
}
// LOS is physical cover, not a cosmetic field-only check.
const losSim = new Simulation({ seed: 31337, hz: 60, benchmark: true });
const rock = losSim.obstacles[0];
assert(rock, 'arena has no cover');
losSim.obstacles = [rock];
losSim.buildObstacleGrid();
const leftX = rock.x - rock.radius - 2.2;
const rightX = rock.x + rock.radius + 2.2;
assert(!losSim.lineOfSight(leftX, rock.z, rightX, rock.z), 'cover did not break line of sight');
assert(losSim.lineOfSight(leftX, rock.z + rock.radius + 1.2, rightX, rock.z + rock.radius + 1.2), 'clear parallel lane was incorrectly blocked');
// Local navigation must route around an island instead of leaning against it forever.
const walker = losSim.spawnEnemyAt('footnote', leftX, rock.z, 0);
assert(walker, 'failed to create navigation actor');
let overlap = 0;
for (let i = 0; i < 300; i++) {
    losSim.steerTo(walker, rightX, rock.z, 4.2);
    losSim.resolveEntityObstacles();
    overlap = Math.max(overlap, rock.radius + walker.radius * 0.7 - Math.hypot(walker.x - rock.x, walker.z - rock.z));
}
assert(walker.x > rock.x + rock.radius * 0.5, 'actor failed to navigate around cover');
assert(overlap < 0.05, `navigation actor penetrated cover by ${overlap}`);
// D21 asks for jobs, not a full formation. A mixed local pack should receive all four.
const taskSim = new Simulation({ seed: 20260919, hz: 60, benchmark: true });
taskSim.ents = [];
const kinds = ['footnote', 'marginwalker', 'bookmark', 'binder', 'indexer', 'palimpsest', 'redactor', 'inkblot'];
for (let i = 0; i < kinds.length; i++) {
    const a = (i / kinds.length) * Math.PI * 2;
    taskSim.spawnEnemyAt(kinds[i], Math.cos(a) * 8, Math.sin(a) * 8, 0);
}
taskSim.updateSquadTasks();
const tasks = new Set(taskSim.ents
    .map((e) => (e.squadUntil > taskSim.time ? e.squadTask : 'none'))
    .filter((x) => x !== 'none'));
for (const task of ['press', 'flank', 'intercept', 'hold'])
    assert(tasks.has(task), `missing squad task ${task}`);
const targets = new Set(taskSim.ents
    .filter((e) => e.squadUntil > taskSim.time)
    .map((e) => `${e.orderX.toFixed(1)}:${e.orderZ.toFixed(1)}`));
assert(targets.size >= 4, 'squad tasks collapsed into one AoE-friendly destination');
const snapshotTasks = new Set(taskSim.snapshot().entities.map((e) => e.squadTask));
assert(snapshotTasks.has('flank') && snapshotTasks.has('hold'), 'task labels missing from snapshot');
console.log('squad-regression OK', {
    tasks: [...tasks].sort(),
    destinations: targets.size,
    routedX: +walker.x.toFixed(2),
    maxOverlap: +Math.max(0, overlap).toFixed(3)
});
