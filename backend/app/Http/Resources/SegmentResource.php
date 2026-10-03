<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SegmentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'script_id' => $this->script_id,
            'sequence' => $this->sequence,
            'timecode_start' => $this->timecode($this->timecode_start_ms),
            'timecode_end' => $this->timecode($this->timecode_end_ms),
            'emotion' => $this->emotion_direction,
            'source_text' => $this->source_text,
            'ai_translation' => null,
            'final_translation' => $this->final_translation,
            'memo' => $this->memo,
            'status' => $this->status,
            'source_version' => $this->source_version,
            'final_source_version' => $this->final_source_version,
            'version' => $this->version,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    private function timecode(?int $milliseconds): ?string
    {
        if ($milliseconds === null) {
            return null;
        }
        $seconds = intdiv($milliseconds, 1000);
        $fraction = $milliseconds % 1000;
        $value = sprintf('%02d:%02d:%02d', intdiv($seconds, 3600), intdiv($seconds % 3600, 60), $seconds % 60);

        return $fraction ? $value.sprintf('.%03d', $fraction) : $value;
    }
}
