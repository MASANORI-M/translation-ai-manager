<?php

namespace App\Http\Controllers;

use App\Http\Requests\SegmentRequest;
use App\Http\Resources\SegmentResource;
use App\Services\SegmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class SegmentController extends Controller
{
    public function __construct(private SegmentService $segments) {}

    public function index(Request $request, int $project, int $script): AnonymousResourceCollection
    {
        $request->validate(['page' => ['sometimes', 'integer', 'min:1']]);

        return SegmentResource::collection($this->segments->list($request->user(), $project, $script));
    }

    public function store(SegmentRequest $request, int $project, int $script): JsonResponse
    {
        return (new SegmentResource($this->segments->create($request->user(), $project, $script, $request->validated())))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $project, int $script, int $segment): SegmentResource
    {
        return new SegmentResource($this->segments->show($request->user(), $project, $script, $segment));
    }

    public function update(SegmentRequest $request, int $project, int $script, int $segment): SegmentResource
    {
        return new SegmentResource($this->segments->update($request->user(), $project, $script, $segment, $request->validated()));
    }

    public function destroy(Request $request, int $project, int $script, int $segment): Response
    {
        $this->segments->delete($request->user(), $project, $script, $segment);

        return response()->noContent();
    }
}
