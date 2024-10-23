import React from 'react'

function HomePage() {
 
  return (
   
<div id="content" className="app-content">

<ol className="breadcrumb float-xl-end">
<li className="breadcrumb-item"><a href="javascript:;">Home</a></li>
<li className="breadcrumb-item"><a href="javascript:;">Page Options</a></li>
<li className="breadcrumb-item active">Blank Page</li>
</ol>


<h1 className="page-header">Blank Page <small>header small text goes here...</small></h1>


<div className="panel panel-inverse">
<div className="panel-heading">
<h4 className="panel-title">Panel Title here</h4>
<div className="panel-heading-btn">
<a href="javascript:;" className="btn btn-xs btn-icon btn-default" data-toggle="panel-expand"><i className="fa fa-expand"></i></a>
<a href="javascript:;" className="btn btn-xs btn-icon btn-success" data-toggle="panel-reload"><i className="fa fa-redo"></i></a>
<a href="javascript:;" className="btn btn-xs btn-icon btn-warning" data-toggle="panel-collapse"><i className="fa fa-minus"></i></a>
<a href="javascript:;" className="btn btn-xs btn-icon btn-danger" data-toggle="panel-remove"><i className="fa fa-times"></i></a>
</div>
</div>
<div className="panel-body">
Panel Content Here
</div>
</div>

</div>

  )
}

export default HomePage