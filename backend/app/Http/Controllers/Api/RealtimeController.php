<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\RealtimeEvent;
use Closure;
use Illuminate\Http\Request;

class RealtimeController extends Controller
{
    private const MAX_SECONDS = 15;
    private const POLL_INTERVAL_SECONDS = 2;

    public function stream(Request $request)
    {
        $after = (int) $request->input('after', 0);
        $channels = ['orders', 'tables', 'dashboard'];

        return $this->sseResponse($this->streamLoop($channels, $after));
    }

    public function poll(Request $request)
    {
        return response()->json($this->eventsAfter(
            ['orders', 'tables', 'dashboard'],
            (int) $request->input('after', 0),
        ));
    }

    public function orderStream(Request $request, string $trackingToken)
    {
        $after = (int) $request->input('after', 0);

        $exists = Order::where('tracking_token', $trackingToken)->exists();

        if (! $exists) {
            return response()->json([
                'message' => 'Order not found',
            ], 404);
        }

        $channels = ['order:' . $trackingToken];

        return $this->sseResponse($this->streamLoop($channels, $after));
    }

    public function orderPoll(Request $request, string $trackingToken)
    {
        if (! Order::where('tracking_token', $trackingToken)->exists()) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return response()->json($this->eventsAfter(
            ['order:' . $trackingToken],
            (int) $request->input('after', 0),
        ));
    }

    private function eventsAfter(array $channels, int $after): array
    {
        $events = RealtimeEvent::where('id', '>', $after)
            ->whereIn('channel', $channels)
            ->orderBy('id')
            ->limit(50)
            ->get();

        return [
            'events' => $events->map(fn (RealtimeEvent $event) => [
                'id' => $event->id,
                'channel' => $event->channel,
                'payload' => $event->payload,
            ])->values(),
        ];
    }

    private function streamLoop(array $channels, int $after): Closure
    {
        return function () use ($channels, $after) {
            set_time_limit(self::MAX_SECONDS + 5);

            $last = $after;
            $started = microtime(true);
            $ticks = 0;

            echo "retry: 2000\n\n";

            while (true) {
                if (connection_aborted()) {
                    break;
                }

                $events = RealtimeEvent::where('id', '>', $last)
                    ->whereIn('channel', $channels)
                    ->orderBy('id')
                    ->limit(50)
                    ->get();

                foreach ($events as $event) {
                    echo 'id: ' . $event->id . "\n";
                    echo 'data: ' . json_encode([
                        'channel' => $event->channel,
                        'payload' => $event->payload,
                    ], JSON_UNESCAPED_UNICODE) . "\n\n";
                    $last = $event->id;
                }

                if ((microtime(true) - $started) >= self::MAX_SECONDS) {
                    break;
                }

                $ticks++;

                if ($ticks % 10 === 0) {
                    echo ": heartbeat\n\n";
                }

                @ob_flush();
                flush();

                sleep(self::POLL_INTERVAL_SECONDS);
            }
        };
    }

    private function sseResponse(Closure $callback)
    {
        return response()->stream($callback, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
