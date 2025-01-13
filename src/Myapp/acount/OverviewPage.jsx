import React from 'react'

function OverviewPage() {
  return (
    <div id="content" class="app-content p-2 d-flex flex-column">
        <div class="row">
				<div class="col-xl-4 col-md-6">
					<div class="widget widget-stats bg-blue border-4  border-top border-red rounded-top-4 rounded-bottom-4 border-bottom">
						<div class="stats-icon text-white"><i class="fa-solid fa-calendar-days"/></div>
						<div class="stats-info">
							<h4>TOTAL VISITORS</h4>
							<p>3,291,922</p>	
						</div>
						<div class="stats-link">
							<a href="javascript:;">View Detail <i class="fa fa-arrow-alt-circle-right"></i></a>
						</div>
					</div>
				</div>
				
				<div class="col-xl-4 col-md-6">
					<div class="widget widget-stats bg-orange border-4  border-top border-red rounded-top-4 rounded-bottom-4 border-bottom">
						<div class="stats-icon"><i class="fa fa-users"></i></div>
						<div class="stats-info">
							<h4>UNIQUE VISITORS</h4>
							<p>1,291,922</p>	
						</div>
						<div class="stats-link">
							<a href="javascript:;">View Detail <i class="fa fa-arrow-alt-circle-right"></i></a>
						</div>
					</div>
				</div>
				<div class="col-xl-4 col-md-6">
					<div class="widget widget-stats bg-green border-4  border-top border-red rounded-top-4 rounded-bottom-4 border-bottom">
						<div class="stats-icon"><i class="fa fa-clock"></i></div>
						<div class="stats-info">
							<h4>AVG TIME ON SITE</h4>
							<p>00:12:23</p>	
						</div>
						<div class="stats-link">
							<a href="javascript:;">View Detail <i class="fa fa-arrow-alt-circle-right"></i></a>
						</div>
					</div>
				</div>
			</div>
    </div>
  )
}

export default OverviewPage